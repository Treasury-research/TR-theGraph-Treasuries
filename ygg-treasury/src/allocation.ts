import { Address, BigDecimal } from "@graphprotocol/graph-ts";
import { Transfer, ERC20 } from "../generated/YGG/ERC20";
import { PairCreated } from "../generated/SushiV2Factory/V2Factory";
import { Sync, V2Pair } from "../generated/templates/V2Pair/V2Pair";
import { V2Pair as V2PairTemplate } from "../generated/templates";
import { Token, Bundle } from "../generated/schema";

const E12 = BigDecimal.fromString("1e12");
const Treasury = Address.fromString(
  "0xe30ed74c6633a1b0d34a71c50889f9f0fdb7d68a"
);
const WETH_USDT_Pair = Address.fromString(
  "0x06da0fd433c1a5d7a4faa01111c044910a184553"
);
const USDT = Address.fromString("0xdac17f958d2ee523a2206206994597c13d831ec7");
const WETH = Address.fromString("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");
const YGG = Address.fromString("0x25f8087ead173b73d6e8b84329989a8eea16cf73");
const USDC = Address.fromString("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
const SAND = Address.fromString("0x3845badade8e6dff049820680d1f14bd3903a5d0");
const REVV = Address.fromString("0x557b933a7c2c45672b610f8954a3deb39a51a8ca");
const XDEFI = Address.fromString("0x72b886d09c117654ab7da13a14d603001de0b777");
const RFOX = Address.fromString("0xa1d6df714f91debf4e0802a542e13067f31b8262");
const RNBW = Address.fromString("0xe94b97b6b43639e238c851a7e693f50033efd75c");
const MIC = Address.fromString("0x368b3a58b5f49392e5c9e4c998cb0bb966752e51");

export function handlePairCreated(event: PairCreated): void {
  if (event.params.token0.equals(WETH)) {
    if (event.params.token1.equals(USDT) || event.params.token1.equals(RNBW)) {
      V2PairTemplate.create(event.params.pair);
    }
  }
  if (event.params.token1.equals(WETH)) {
    if (
      event.params.token0.equals(YGG) ||
      event.params.token0.equals(USDC) ||
      event.params.token0.equals(REVV) ||
      event.params.token0.equals(XDEFI) ||
      event.params.token0.equals(RFOX) ||
      event.params.token0.equals(MIC)
    ) {
      V2PairTemplate.create(event.params.pair);
    }
  }
  if (event.params.token0.equals(SAND) && event.params.token1.equals(USDT)) {
    V2PairTemplate.create(event.params.pair);
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
  if (v2pair.token1().equals(RNBW)) {
    let token = Token.load(RNBW.toHex());
    if (!token) return;
    token.priceUSD = bundle.ethPriceUSD.times(reserve0.div(reserve1));
    token.valueUSD = token.balance.times(token.priceUSD);
    token.save();
  } else if (v2pair.token0().equals(SAND)) {
    let token = Token.load(SAND.toHex());
    if (!token) return;
    token.priceUSD = reserve1.times(E12).div(reserve0);
    token.valueUSD = token.balance.times(token.priceUSD);
    token.save();
  } else if (v2pair.token0().equals(USDC)) {
    let token = Token.load(USDC.toHex());
    if (!token) return;
    token.priceUSD = bundle.ethPriceUSD.times(reserve1.div(reserve0).div(E12));
    token.valueUSD = token.balance.times(token.priceUSD);
    token.save();
  } else {
    let tokenId = v2pair.token0().toHex();
    let token = Token.load(tokenId);
    if (!token) return;
    token.priceUSD = bundle.ethPriceUSD.times(reserve1.div(reserve0));
    token.valueUSD = token.balance.times(token.priceUSD);
    token.save();
  }
}
