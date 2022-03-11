import {
  ethereum,
  Address,
  BigDecimal,
  BigInt,
  store,
} from "@graphprotocol/graph-ts";
import { PoolCreated } from "../generated/UniV3Factory/V3Factory";
import { Swap, V3Pool } from "../generated/templates/V3Pool/V3Pool";
import { V3Pool as V3PoolTemplate } from "../generated/templates";
import {
  DailyVolume,
  DailySwap,
  InQueueSwapID,
  Token,
} from "../generated/schema";

const ONE_DAY = BigInt.fromString("86400");
const ZERO = BigDecimal.fromString("0");
const E18 = BigDecimal.fromString("1e18");
const TRIBE = Address.fromString("0xc7283b66eb1eb5fb86327f08e1b5816b0720212b");

export function handlePoolCreated(event: PoolCreated): void {
  if (event.params.token0.equals(TRIBE) || event.params.token1.equals(TRIBE)) {
    V3PoolTemplate.create(event.params.pool);
  }
}

export function handleBlock(block: ethereum.Block): void {
  let queue = InQueueSwapID.load("queue");
  if (!queue) return;
  if (queue.swapIds.length == 0) return;
  let swap = DailySwap.load(queue.swapIds[0]);
  if (block.timestamp.gt(swap!.timestamp.plus(ONE_DAY))) {
    store.remove("DailySwap", swap!.id);
    let dailyVolume = DailyVolume.load(TRIBE.toHex());
    dailyVolume!.volume = dailyVolume!.volume.minus(swap!.valueUSD);
    dailyVolume!.save();
    queue.swapIds = queue.swapIds.slice(1);
    queue.save();
  }
}

export function handleSwap(event: Swap): void {
  let token = Token.load(TRIBE.toHex());
  if (!token) return;
  if (token.priceUSD.equals(ZERO)) return;

  let queue = InQueueSwapID.load("queue");
  if (!queue) {
    queue = new InQueueSwapID("queue");
    queue.swapIds = new Array<string>();
  }

  let dailyVolume = DailyVolume.load(TRIBE.toHex());
  if (!dailyVolume) {
    dailyVolume = new DailyVolume(TRIBE.toHex());
    dailyVolume.symbol = "TRIBE";
  }

  let amount = (V3Pool.bind(event.address)
    .token0()
    .equals(TRIBE)
    ? event.params.amount0
    : event.params.amount1
  )
    .toBigDecimal()
    .div(E18);
  if (amount.lt(ZERO)) {
    amount = ZERO.minus(amount);
  }

  //consider the situation one hash contains several swaps
  let id = event.transaction.hash.toHex();
  let swap = DailySwap.load(id);
  if (!swap) {
    swap = new DailySwap(id);
    swap.amount = amount;
    swap.valueUSD = amount.times(token.priceUSD);
    swap.timestamp = event.block.timestamp;
  } else {
    for (let i = 2; i < 100; i++) {
      id = event.transaction.hash.toHex();
      id = id.concat("_").concat(i.toString());
      swap = DailySwap.load(id);
      if (!swap) {
        swap = new DailySwap(id);
        swap.amount = amount;
        swap.valueUSD = amount.times(token.priceUSD);
        swap.timestamp = event.block.timestamp;
        break;
      }
    }
  }
  swap.save();
  queue.swapIds = queue.swapIds.concat([id]);
  dailyVolume.volume = dailyVolume.volume.plus(swap.valueUSD);
  queue.save();
  dailyVolume.save();
}
