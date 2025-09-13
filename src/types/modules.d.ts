declare module '@sveltejs/pancake' {
  export const Chart: any;
  export const Grid: any;
  export const Svg: any;
  export const SvgScatterplot: any;
  export const Quadtree: any;
  export const Point: any;
}

declare module '*.json' {
  const value: any;
  export default value;
}

interface PaperData {
  author: string;
  year: string;
  title: string;
  link: string;
  journal: string;
  volume: string;
  short_title: string;
  main_category: string;
  sub_category: string;
  report_type: string;
  show?: boolean;
}

declare module 'csvtojson' {
  const csv: any;
  export default csv;
}
