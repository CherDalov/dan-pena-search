export interface VideoMeta {
  id: string;
  title: string;
}

export interface RawSegment {
  v: number; // index into videos[]
  t: number; // start time in seconds
  x: string; // transcript text
}

export interface IndexFile {
  channel: string;
  generated: string;
  sample?: boolean;
  videos: VideoMeta[];
  segments: RawSegment[];
}

// "any" (used by Themes): exact phrases separated by "|", any may match
export type Mode = "phrase" | "all" | "any";

export interface Hit {
  id: string; // youtube video id
  title: string;
  start: number; // seconds
  text: string;
  terms: string[]; // strings to highlight
}
