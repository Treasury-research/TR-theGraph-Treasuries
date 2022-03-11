import { Address, BigDecimal } from "@graphprotocol/graph-ts";
import { Transfer, ERC20 } from "../generated/BIT/ERC20";
import { PairCreated } from "../generated/SushiV2Factory/V2Factory";
import { Sync, V2Pair } from "../generated/templates/V2Pair/V2Pair";
import { V2Pair as V2PairTemplate } from "../generated/templates";
import { Token, Bundle } from "../generated/schema";

const E12 = BigDecimal.fromString("1e12");
const Treasury = Address.fromString(
  "0x78605df79524164911c144801f41e9811b7db73d"
);
const SushiV2Factory = Address.fromString(
  "0xc0aee478e3658e2610c5f7a4a2e1777ce9e4f2ac"
);
const UniV2Factory = Address.fromString(
  "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f"
);
const WETH_USDT_Pair = Address.fromString(
  "0x06da0fd433c1a5d7a4faa01111c044910a184553"
);
const WETH = Address.fromString("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");
const USDT = Address.fromString("0xdac17f958d2ee523a2206206994597c13d831ec7");
const USDC = Address.fromString("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
const BIT = Address.fromString("0x1a4b46696b2bb4794eb3d4c26f1c55f9170fa4c5");
const FTT = Address.fromString("0x50d1c9771902476076ecfc8b2a83ad6b9355a4c9");
const xSUSHI = Address.fromString("0x8798249c2e607446efb7ad49ec89dd1865ff4272");
const ZKS = Address.fromString("0xe4815ae53b124e7263f08dcdbbb757d41ed658c6"); //UniV2 reserved
const GERO = Address.fromString("0x3431f91b3a388115f00c5ba9fdb899851d005fb5");

export function handlePairCreated(event: PairCreated): void {
  if (event.address.equals(SushiV2Factory)) {
    if (event.params.token0.equals(WETH) && event.params.token1.equals(USDT)) {
      V2PairTemplate.create(event.params.pair);
    }
    if (event.params.token1.equals(WETH)) {
      if (
        event.params.token0.equals(BIT) ||
        event.params.token0.equals(FTT) ||
        event.params.token0.equals(xSUSHI)
      ) {
        V2PairTemplate.create(event.params.pair);
      }
    }
  } else if (event.address.equals(UniV2Factory)) {
    if (event.params.token0.equals(WETH) && event.params.token1.equals(ZKS)) {
      V2PairTemplate.create(event.params.pair);
    }
    if (event.params.token0.equals(GERO) && event.params.token1.equals(WETH)) {
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
  if (v2pair.token1().equals(ZKS)) {
    let token = Token.load(ZKS.toHex());
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
