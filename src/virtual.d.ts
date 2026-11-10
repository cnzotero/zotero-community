declare module "virtual:plugin-catalog" {
  const data: { generatedAt: string; plugins: import("./plugins/lib.ts").Plugin[] };
  export default data;
}

declare module "virtual:home-boards" {
  const boards: import("./plugins/lib.ts").HomeBoards;
  export default boards;
}

declare module "virtual:compat-index" {
  const index: { major: number; count: number }[];
  export default index;
}

declare module "virtual:delisted" {
  const data: import("./plugins/delisted.ts").DelistedData;
  export default data;
}
