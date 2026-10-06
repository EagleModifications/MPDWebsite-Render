export type WheelEntry = {
  id: string;
  text: string;
  color: string;
  image?: string;
};

export type SpinResult = {
  entry: WheelEntry;
  index: number;
};
