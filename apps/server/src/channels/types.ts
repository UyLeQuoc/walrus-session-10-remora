export interface ChannelAdapter {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}
