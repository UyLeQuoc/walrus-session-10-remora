import { ChannelCredentials } from "@grpc/grpc-js";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";

/**
 * Mysten's public fullnode over native gRPC, never JSON-RPC (Sui is retiring it). The paid door reads
 * MPP payments sent by digest with it.
 */
export function publicSuiClient(network: "mainnet" | "testnet"): SuiGrpcClient {
  const transport = new GrpcTransport({
    host: `fullnode.${network}.sui.io:443`,
    channelCredentials: ChannelCredentials.createSsl(),
    timeout: 30_000,
  });
  return new SuiGrpcClient({ network, transport });
}
