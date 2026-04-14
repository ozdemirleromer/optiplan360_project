export interface NestingPart {
  id: string | number;
  x: number;
  y: number;
  width: number;
  height: number;
  is_waste?: boolean;
  desc?: string;
}

export interface NestingSheet {
  id: string | number;
  width: number;
  height: number;
  parts: NestingPart[];
}

export interface NestingData {
  sheets: NestingSheet[];
}