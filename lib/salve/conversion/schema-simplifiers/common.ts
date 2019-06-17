import * as datatypes from "../../datatypes";
import { Data, Value } from "../../patterns";
import { Element, isElement, Text } from "../parser";

const warnAboutTheseTypes: string[] = [
  "ENTITY",
  "ENTITIES",
];

/**
 * @private
 *
 * @param el Element to start the search from.
 *
 * @returns ``true`` if ``el`` is an attribute or is in an RNG
 * ``<attribute>`` element. ``false`` otherwise.
 */
function inAttribute(el: Element): boolean {
  let current: Element | undefined = el;
  while (current !== undefined) {
    if (current.local === "attribute") {
      return true;
    }
    current = current.parent;
  }

  return false;
}

export function localName(value: string): string {
  const sep = value.indexOf(":");

  return (sep === -1) ? value : value.slice(sep + 1);
}

export function fromQNameToURI(value: string, el: Element): string {
  const colon = value.indexOf(":");

  let prefix: string;
  if (colon === -1) { // If there is no prefix
    if (inAttribute(el)) { // Attribute in undefined namespace
      return "";
    }

    // We are searching for the default namespace currently in effect.
    prefix = "";
  }
  else {
    prefix = value.substr(0, colon);
    if (value.lastIndexOf(":") !== colon) {
      throw new Error("invalid name");
    }
  }

  if (prefix === "") {
    // Yes, we return the empty string even if that what @ns is set to:
    // there is no default namespace when @ns is set to ''.
    return el.mustGetAttribute("ns");
  }

  //
  // We have a prefix, in which case @ns is useless. We have to get the
  // namespace from the namespaces declared in the XML file that contains the
  // schema. At this stage, @xmlns and @xmlns:prefix attributes should no longer
  // be available available. So we just ask the element to use its internal
  // namespace data to resolve the prefix.
  //
  // (Note: in fact in the current implementation of the simplifiers the xmlns
  // nodes are still available. The XSLT simplifier *cannot* carry the namespace
  // information we need without keeping those nodes around, or producing a
  // workaround. The internal simplifier does the same thing as the XSLT
  // simplifier for ease of debugging (we can expect the same results from
  // both). However... in any case the information is available through the
  // namespace information stored on the nodes. So...)
  //
  const uri = el.resolve(prefix);
  if (uri === undefined) {
    throw new Error(`cannot resolve prefix: ${prefix}`);
  }

  return uri;
}

/**
 * This walker checks that the types used in the tree can be used, and does
 * special processing for ``QName`` and ``NOTATION``.
 */
export class DatatypeProcessor {
  /**
   * The warnings generated during the walk. This array is populated while
   * walking.
   */
  readonly warnings: string[] = [];

  // tslint:disable-next-line:max-func-body-length
  walk(el: Element): void {
    let libname: string | undefined;
    let type: string | undefined; // tslint:disable-line: no-reserved-keywords

    const name = el.local;
    switch (name) {
      case "value": {
        let value = el.text;
        type = el.mustGetAttribute("type");
        libname = el.mustGetAttribute("datatypeLibrary");
        let ns = el.mustGetAttribute("ns");

        const lib = datatypes.registry.find(libname);
        if (lib === undefined) {
          throw new datatypes.ValueValidationError(el.path,
            [new datatypes.ValueError(`unknown datatype library: ${libname}`)]);
        }

        const datatype = lib.types[type];
        if (datatype === undefined) {
          throw new datatypes.ValueValidationError(el.path,
            [new datatypes.ValueError(`unknown datatype ${type} in \
${(libname === "") ? "default library" : `library ${libname}`}`)]);
        }

        if (datatype.needsContext &&
            // tslint:disable-next-line: no-http-string
            !(libname === "http://www.w3.org/2001/XMLSchema-datatypes" &&
              (type === "QName" || type === "NOTATION"))) {
          throw new Error("datatype needs context but is not QName or NOTATION \
form the XML Schema library: don't know how to handle");
        }

        if (datatype.needsContext) {
          // Change ns to the namespace we need.
          ns = fromQNameToURI(value, el);
          el.setAttribute("ns", ns);
          value = localName(value);
          el.empty();
          el.appendChild(new Text(value));
        }

        const valuePattern = new Value(el.path, value, type, libname, ns);

        // Accessing the value will cause it to be validated.
        // tslint:disable-next-line:no-unused-expression
        valuePattern.value;
        break;
      }
      case "data": {
        // Except is necessarily last.
        const hasExcept = (el.children.length !== 0 &&
                           (el.children[el.children.length - 1] as Element)
                           .local === "except");

        type = el.mustGetAttribute("type");
        libname = el.mustGetAttribute("datatypeLibrary");
        const lib = datatypes.registry.find(libname);
        if (lib === undefined) {
          throw new datatypes.ValueValidationError(el.path,
            [new datatypes.ValueError(`unknown datatype library: ${libname}`)]);
        }

        if (lib.types[type] === undefined) {
          throw new datatypes.ValueValidationError(el.path,
            [new datatypes.ValueError(`unknown datatype ${type} in \
${(libname === "") ? "default library" : `library ${libname}`}`)]);
        }

        const params = el.children.slice(
          0, hasExcept ? el.children.length - 1 : undefined).map(
            (child: Element) => ({
              name: child.mustGetAttribute("name"),
              value: child.text,
            }));

        const data = new Data(el.path, type, libname, params);

        // This causes the parameters to be checked. We do not need to do
        // anything with the value.
        // tslint:disable-next-line:no-unused-expression
        data.params;
        break;
      }
      default:
    }

    // tslint:disable-next-line: no-http-string
    if (libname === "http://www.w3.org/2001/XMLSchema-datatypes" &&
        // tslint:disable-next-line:no-non-null-assertion
        warnAboutTheseTypes.includes(type!)) {
      this.warnings.push(
        `WARNING: ${el.path} uses the ${type} type in library ${libname}`);
    }

    for (const child of el.children) {
      if (isElement(child)) {
        this.walk(child);
      }
    }
  }
}
