/**
 * Simplification support for trees produced by the parser module.
 *
 * This is an implementation in TypeScript of the XSLT pipeline we've been
 * using. The step numbers are equivalent to those in the XSLT pipeline with the
 * following exceptions:
 *
 * - ``step0`` does not exist as a separate step in the XSLT pipline.
 *
 * - Some steps are combined. The driving principles are:
 *
 *  + Steps are not combined if a later step is entirely dependent on the work
 *    of an earlier step.
 *
 *  + Steps are combined if they offer substantial performance benefits.
 *
 * Eventually the goal is to completely eliminate the XSLT pipeline. However,
 * during the transition phase we aim for relative parity with what the XSLT
 * pipeline does, in order to simplify testing. With a few small exceptions, we
 * can provide an input to a step and expect the same output in the XSLT and
 * TypeScript pipelines. So the TypeScript implementation may do things that
 * appears senseless. For instance, at some point all ``define`` elements are
 * renamed to make them unique, even those that do not have name clashes. We
 * replicate the XSLT process, where only renaming clashing defines would be
 * onerous. (It would also require the renaming operation to verify that new
 * names do not clash with those names that are not changed. If we change all
 * names, then this clash cannot occur.)
 *
 * @author Louis-Dominique Dubeau
 * @license MPL 2.0
 * @copyright 2013, 2014 Mangalam Research Center for Buddhist Languages
 */
export { step1 } from "./simplifier/step1";
// Step 2 is covered by step 1.
export { step3 } from "./simplifier/step3";
export { step4 } from "./simplifier/step4";
// Step 5 is covered by step 4.
export { step6 } from "./simplifier/step6";
// Steps 7-8 are covered by step 6.
export { step9 } from "./simplifier/step9";

export { step10 } from "./simplifier/step10";
// Steps 11-13 are covered by step 10.
export { step14 } from "./simplifier/step14";
export { step15 } from "./simplifier/step15";
export { step16 } from "./simplifier/step16";
export { step17 } from "./simplifier/step17";
export { step18 } from "./simplifier/step18";
