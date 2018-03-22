/**
 * Serialization support for trees produced by the {@link
 * module:conversion/parser parser} module.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
import { Element, Text } from "./parser";

//
// WARNING: This serializer is *not* meant to be able to handle all possible XML
// under the sun. Don't export this code into another project.
//
// In fact it used only for testing conversion code. We keep it as part of the
// library so that it is available for possible diagnostic tools but it is
// really not meant to be used as part of normal salve operations.
//
// In particular, the logic in here is very dependent on how the code in its
// sibling module parser.js constructs a tree of elements.
//

export interface SerializationOptions {
  /** Whether to pretty print the results. */
  prettyPrint?: boolean;
}

interface NormalizedSerializationOptions {
  /** Whether to pretty print the results. */
  prettyPrint: boolean;
}

/**
 * Serialize a tree previously produced by [["conversion/parser".Parser]].
 *
 * @param tree The tree to serialize.
 *
 * @param options Options specifying how to perform the serialization.
 *
 * @returns The serialized tree.
 */
export function serialize(tree: Element,
                          options: SerializationOptions = {}): string {
  const normalized: NormalizedSerializationOptions = {
    prettyPrint: options.prettyPrint === true,
  };
  let out = `<?xml version="1.0"?>\n${_serialize(false, "", tree, normalized)}`;

  if (out[out.length - 1] !== "\n") {
    out += "\n";
  }

  return out;
}

/**
 * Escape characters that cannot be represented literally in XML.
 *
 * @param text The text to escape.
 *
 * @param isAttr Whether the text is part of an attribute.
 *
 * @returns The escaped text.
 */
function escape(text: string, isAttr: boolean): string {
  // Even though the > escape is not *mandatory* in all cases, we still do it
  // everywhere.
  let ret = text.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  if (isAttr) {
    ret = ret.replace(/"/g, "&quot;");
  }

  return ret;
}

/**
 * Serialize an element and its children, recursively.
 *
 * @param mixed Whether or not the element being converted is in mixed contents.
 *
 * @param curIndent The current indentation. This is represented as a string of
 * white spaces.
 *
 * @param el The element to serialize.
 *
 * @param options Options specifying how to perform the serialization.
 *
 * @returns The serialization.
 */
function _serialize(mixed: boolean,
                    curIndent: string,
                    el: Element,
                    options: NormalizedSerializationOptions): string {
  let buf = "";

  buf += `${curIndent}<${el.name}`;
  const attrs = el.getAttributes();
  const names = Object.keys(attrs);
  names.sort();
  for (const name of names) {
    buf += ` ${name}="${escape(el.mustGetAttribute(name), true)}"`;
  }
  if (el.children.length === 0) {
    buf += "/>";
  }
  else {
    let childrenMixed = false;
    for (const child of el.children) {
      if (child instanceof Text) {
        childrenMixed = true;
        break;
      }
    }

    buf += ">";
    if (options.prettyPrint && !childrenMixed) {
      buf += "\n";
    }

    const childIndent = options.prettyPrint ? `${curIndent}  ` : "";

    for (const child of el.children) {
      buf += (child instanceof Text) ?
        escape(child.text, false) :
        _serialize(childrenMixed, childIndent, child, options);
    }

    if (!childrenMixed) {
      buf += curIndent;
    }

    buf += `</${el.name}>`;
  }

  if (options.prettyPrint && !mixed) {
    buf += "\n";
  }

  return buf;
}
