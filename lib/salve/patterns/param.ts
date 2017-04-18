/**
 * Pattern for RNG's ``param`` element.
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright Mangalam Research Center for Buddhist Languages
 */
import { Pattern } from "./base";

/**
 * This is a defunct pattern. During the processing of the RNG file all
 * ``param`` elements are converted into parameters to [["./data".Data]] so we
 * never end up with a converted file that contains an instance of this class.
 */
export class Param extends Pattern {
  constructor(xmlPath: string) {
    super(xmlPath);
    throw new Error("this pattern is a placeholder and should never actually " +
                    "be used");
  }
}
