import { Address, BigDecimal, BigInt, store } from "@graphprotocol/graph-ts";
import { Transfer, ERC20 } from "../generated/BANK/ERC20";
import { NumberOfHolder, Holder } from "../generated/schema";

const E18 = BigDecimal.fromString("1e18");
const ZERO = BigDecimal.fromString("0");
const ONE = BigInt.fromString("1");

const ADDRESS_ZERO = Address.fromString(
  "0x0000000000000000000000000000000000000000"
);

export function handleNativeTransfer(event: Transfer): void {
  let numberOfHolder = NumberOfHolder.load(event.address.toHex());
  if (!numberOfHolder) {
    numberOfHolder = new NumberOfHolder(event.address.toHex());
    numberOfHolder.symbol = ERC20.bind(event.address).symbol();
  }

  if (event.params.value.toBigDecimal().notEqual(ZERO)) {
    let holder = Holder.load(event.params.to.toHex());
    if (!holder) {
      holder = new Holder(event.params.to.toHex());
      numberOfHolder.number = numberOfHolder.number.plus(ONE);
    }
    holder.amount = holder.amount.plus(
      event.params.value.toBigDecimal().div(E18)
    );
    holder.save();

    if (event.params.from.notEqual(ADDRESS_ZERO)) {
      let holder = Holder.load(event.params.from.toHex());
      holder!.amount = holder!.amount.minus(
        event.params.value.toBigDecimal().div(E18)
      );
      if (holder!.amount.equals(ZERO)) {
        store.remove("Holder", event.params.from.toHex());
        numberOfHolder.number = numberOfHolder.number.minus(ONE);
      } else {
        holder!.save();
      }
    }
  }
  numberOfHolder.save();
}
