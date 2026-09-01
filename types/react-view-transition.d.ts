import type { ReactNode } from "react";

/**
 * ============================================================
 * <ViewTransition> - a type declaration Next needs and @types/react lacks
 * ============================================================
 *
 * WHY THIS FILE EXISTS
 *
 * `experimental.viewTransition` makes Next alias `react` to its own vendored
 * copy, and that copy DOES export `ViewTransition`:
 *
 *   node_modules/next/dist/compiled/react/cjs/react.development.js
 *     -> exports.ViewTransition
 *
 * The installed react@19.2.4 and @types/react@19.2.17 do not, because the
 * component is a React canary feature. So the import resolves and runs
 * correctly at build and at runtime, and only TypeScript cannot see it.
 *
 * This declares the shape rather than silencing the error with a
 * @ts-expect-error. An expect-error would suppress every future problem on
 * that line too, including a genuine one - and it would say nothing about what
 * the props are.
 *
 * DELETE THIS FILE if experimental.viewTransition is turned off, or when
 * @types/react ships the real declaration. It is part of FF-52.
 */

declare module "react" {
  /**
   * A map from transition type (as passed in <Link transitionTypes={[...]}>)
   * to the class used in ::view-transition-old()/new(). "default" covers a
   * navigation that carries no type - such as a first page load.
   */
  type ViewTransitionClass = string | "none" | "auto";

  type ViewTransitionTypeMap = Record<string, ViewTransitionClass>;

  interface ViewTransitionProps {
    children?: ReactNode;
    /** Shared-element name, for morphing one element into another. */
    name?: string;
    enter?: ViewTransitionClass | ViewTransitionTypeMap;
    exit?: ViewTransitionClass | ViewTransitionTypeMap;
    update?: ViewTransitionClass | ViewTransitionTypeMap;
    share?: ViewTransitionClass | ViewTransitionTypeMap;
    default?: ViewTransitionClass;
  }

  export const ViewTransition: (props: ViewTransitionProps) => ReactNode;
}
