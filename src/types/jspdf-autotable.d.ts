declare module "jspdf-autotable" {
  import type { jsPDF } from "jspdf";

  export interface AutoTableOptions {
    head?: any[][];
    body?: any[][];
    foot?: any[][];
    startY?: number;
    margin?: any;
    styles?: any;
    headStyles?: any;
    bodyStyles?: any;
    footStyles?: any;
    columnStyles?: any;
    [key: string]: any;
  }

  export interface AutoTableState {
    finalY: number;
    [key: string]: any;
  }

  export default function autoTable(doc: jsPDF, options: AutoTableOptions): jsPDF;
}

declare module "jspdf" {
  interface jsPDF {
    lastAutoTable?: {
      finalY: number;
      [key: string]: any;
    };
  }
}
