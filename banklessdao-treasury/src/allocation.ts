import { Address, BigDecimal } from "@graphprotocol/graph-ts";
import { Transfer, ERC20 } from "../generated/BANK/ERC20";
import { PairCreated } from "../generated/SushiV2Factory/V2Factory";
import { Sync, V2Pair } from "../generated/templates/V2Pair/V2Pair";
import { V2Pair as V2PairTemplate } from "../generated/templates";
import { Token, Bundle } from "../generated/schema";

const E12 = BigDecimal.fromString("1e12");
const Treasury = Address.fromString(
  "0xf26d1bb347a59f6c283c53156519cc1b1abaca51"
);
const WETH_USDT_Pair = Address.fromString(
  "0x06da0fd433c1a5d7a4faa01111c044910a184553"
);
const WETH = Address.fromString("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");
const USDT = Address.fromString("0xdac17f958d2ee523a2206206994597c13d831ec7");
const USDC = Address.fromString("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
const BANK = Address.fromString("0x2d94aa3e47d9d5024503ca8491fce9a2fb4da198");
const RARI = Address.fromString("0xfca59cd816ab1ead66534d82bc21e7515ce441cf"); //reserved
const DAI = Address.fromString("0x6b175474e89094c44da98b954eedeac495271d0f");
const INDEX = Address.fromString("0x0954906da0bf32d5479e25f46056d22f08464cab");
const UMA = Address.fromString("0x04fa0d235c4abf4bcf4787af4cf447de572ef828");
const PERP = Address.fromString("0xbc396689893d065f41bc2c6ecbee5e0085233447");
const MASK = Address.fromString("0x69af81e73a73b40adf4f3d4223cd9b1ece623074");
const SUSHI = Address.fromString("0x6b3595068778dd592e39a122f4f5a5cf09c90fe2");
const GRT = Address.fromString("0xc944e90c64b2c07662a292be6244bdf05cda44a7"); //reserved

export function handlePairCreated(event: PairCreated): void {
  if (event.params.token0.equals(WETH)) {
    if (
      event.params.token1.equals(USDT) ||
      event.params.token1.equals(RARI) ||
      event.params.token1.equals(GRT)
    ) {
      V2PairTemplate.create(event.params.pair);
    }
  } else if (event.params.token1.equals(WETH)) {
    if (
      event.params.token0.equals(BANK) ||
      event.params.token0.equals(DAI) ||
      event.params.token0.equals(INDEX) ||
      event.params.token0.equals(UMA) ||
      event.params.token0.equals(PERP) ||
      event.params.token0.equals(MASK) ||
      event.params.token0.equals(SUSHI)
    ) {
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
    if (event.address.equals(USDT) || event.address.equals(USDC)) {
      token.priceUSD = BigDecimal.fromString("1");
      token.valueUSD = token.balance;
    }
    if (event.address.equals(WETH)) {
      let bundle = Bundle.load("bundle");
      if (bundle) {
        token.priceUSD = bundle.ethPriceUSD;
        token.valueUSD = token.balance.times(token.priceUSD);
      }
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
  if (v2pair.token1().equals(RARI) || v2pair.token1().equals(GRT)) {
    let tokenId = v2pair.token1().toHex();
    let token = Token.load(tokenId);
    if (!token) return;
    token.priceUSD = bundle.ethPriceUSD.times(reserve0.div(reserve1));
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
