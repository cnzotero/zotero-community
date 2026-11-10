declare module "virtual:home-boards" {
  const boards: import("./plugins/lib.ts").HomeBoards;
  export default boards;
}

declare module "virtual:compat-index" {
  const index: { major: number; count: number }[];
  export default index;
}
