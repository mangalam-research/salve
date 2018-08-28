/**
 * Implements a name resolver for handling namespace changes in XML.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */

import { EName } from "./ename";

//
// Both defined at:
// http://www.w3.org/TR/REC-xml-names/#ns-decl
//

/**
 * The namespace URI for the "xml" prefix. This is part of the [XML
 * spec](http://www.w3.org/TR/REC-xml-names/#ns-decl).
 */
// tslint:disable-next-line: no-http-string
export const XML1_NAMESPACE = "http://www.w3.org/XML/1998/namespace";

/**
 * The namespace URI for the "xmlns" prefix. This is part of the [XML
 * spec](http://www.w3.org/TR/REC-xml-names/#ns-decl).
 */
// tslint:disable-next-line: no-http-string
export const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";

/**
 * A name resolver for handling namespace changes in XML.
 */
export interface NameResolver {
  /**
   * Resolves a qualified name to an expanded name. A qualified name is an XML
   * name optionally prefixed by a namespace prefix. For instance, in ``<html
   * xml:lang="en">``, "html" is a name without a prefix, and "xml:lang" is a
   * name with the "xml" prefix. An expanded name is a (URI, name) pair.
   *
   * @param name The name to resolve.
   *
   * @param attribute Whether this name appears as an attribute.
   *
   * @throws {Error} If the name is malformed. For instance, a name with two
   * colons would be malformed.
   *
   * @returns The expanded name, or ``undefined`` if the name cannot be
   * resolved.
   */
  resolveName(name: string, attribute?: boolean): EName | undefined;

  /**
   * Makes a deep copy.
   *
   * @returns A deep copy of the resolver.
   */
  clone(): this;
}

//  LocalWords:  unprefixed nameResolver pre definePrefix Unresolves qname vm
//  LocalWords:  redeclarations newID ename lang html NameResolver Mangalam uri
//  LocalWords:  xmlns URI Dubeau resolveName xml MPL unresolving namespace
