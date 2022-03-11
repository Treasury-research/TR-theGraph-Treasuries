import { Address, BigDecimal } from "@graphprotocol/graph-ts";
import { Transfer, ERC20 } from "../generated/TRIBE/ERC20";
import { PairCreated } from "../generated/UniV2Factory/V2Factory";
import { Sync, V2Pair } from "../generated/templates/V2Pair/V2Pair";
import { V2Pair as V2PairTemplate } from "../generated/templates";
import { Token, Bundle } from "../generated/schema";

const E12 = BigDecimal.fromString("1e12");
const Treasury = Address.fromString(
  "0x8d5ed43dca8c2f7dfb20cf7b53cc7e593635d7b9"
);
const WETH_USDT_Pair = Address.fromString(
  "0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852"
);
const WETH = Address.fromString("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");
const USDT = Address.fromString("0xdac17f958d2ee523a2206206994597c13d831ec7");
const TRIBE = Address.fromString("0xc7283b66eb1eb5fb86327f08e1b5816b0720212b");

export function handlePairCreated(event: PairCreated): void {
  if (event.params.token0.equals(WETH)) {
    if (event.params.token1.equals(USDT) || event.params.token1.equals(TRIBE)) {
      V2PairTemplate.create(event.params.pair);
    }
  }
}

export function handleTransfer(event: Transfer): void {
  if (event.params.from.equals(Treasury) || event.params.to.equals(Treasury)) {
    let token = Token.load(event.address.toHex());
    if (!token) {
      token = new Token(event.address.toHex());
      token.symbol = ERC20.bind(event.address).symbol();
    }
    let decimals = ERC20.bind(event.address).decimals();
    let divisor = BigDecimal.fromString("1e" + decimals.toString());
    let value = event.params.value.toBigDecimal();
    if (event.params.to.equals(Treasury)) {
      token.balance = token.balance.plus(value.div(divisor));
    } else if (event.params.from.equals(Treasury)) {
      token.balance = token.balance.minus(value.div(divisor));
    }
    token.save();
  }
}

export function handleSync(event: Sync): void {
  if (event.address.equals(WETH_USDT_Pair)) {
    updateBundle(
      event.params.reserve0.toBigDecimal(),
      event.params.reserve1.toBigDecimal()
    );
  } else {
    updatePriceAndValue(
      event.address,
      event.params.reserve0.toBigDecimal(),
      event.params.reserve1.toBigDecimal()
    );
  }
}

function updateBundle(reserve0: BigDecimal, reserve1: BigDecimal): void {
  let bundle = Bundle.load("bundle");
  if (!bundle) {
    bundle = new Bundle("bundle");
  }
  bundle.ethPriceUSD = reserve1.times(E12).div(reserve0);
  bundle.save();
}

function updatePriceAndValue(
  address: Address,
  reserve0: BigDecimal,
  reserve1: BigDecimal
): void {
  let bundle = Bundle.load("bundle");
  if (!bundle) return;
  let v2pair = V2Pair.bind(address);
  let tokenId = v2pair.token1().toHex();
  let token = Token.load(tokenId);
  if (!token) return;
  token.priceUSD = bundle.ethPriceUSD.times(reserve0.div(reserve1));
  token.valueUSD = token.balance.times(token.priceUSD);
  token.save();
}
