/**
 * Class modeling a fatal error in the CLI tools.
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { fixPrototype } from "../../tools";

export class Fatal extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "Fatal";
    this.message = msg;
    fixPrototype(this, Fatal);
 }
}
