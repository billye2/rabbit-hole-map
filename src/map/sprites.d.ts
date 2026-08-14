// esbuild's dataurl loader turns .png imports into data: URL strings.
declare module '*.png' {
  const dataUrl: string;
  export default dataUrl;
}
