/* @flow strict */

// flow-typed has no libdef for this Flow version, so only the entry points
// this project uses are declared here.
declare module 'react-dom/client' {
  declare type RootOptions = {
    readonly identifierPrefix?: string,
    readonly onRecoverableError?: (error: unknown) => void,
  };

  declare type Root = {
    render(children: React.Node): void,
    unmount(): void,
  };

  declare export function createRoot(
    container: Element | DocumentFragment,
    options?: RootOptions,
  ): Root;

  declare export function hydrateRoot(
    container: Element | Document,
    initialChildren: React.Node,
    options?: RootOptions,
  ): Root;
}
