module sentinel::sentinel;


const DECIMALS: u8 = 0;
const NAME: vector<u8> = b"Sentinel";
const SYMBOL: vector<u8> = b"SENTINEL";
const DESCRIPTION: vector<u8> =
    b"Sentinel, utility token for Sui Sentinel, gamified AI security platform on Sui.";
const ICON_URL: vector<u8> =
    b"https://www.suisentinel.xyz/sentinel_coin.png";

const TOTAL_SUPPLY: u64 = 10_000_000_000;


public struct SENTINEL has drop {}

public struct ProtectedTreasury has key {
    id: UID,
}

public struct TreasuryCapKey has copy, drop, store {}

public fun burn(arg0: &mut ProtectedTreasury, arg1: sui::coin::Coin<SENTINEL>) {
    sui::coin::burn<SENTINEL>(borrow_cap_mut(arg0), arg1);
}

public fun total_supply(arg0: &ProtectedTreasury): u64 {
    sui::coin::total_supply<SENTINEL>(borrow_cap(arg0))
}

fun borrow_cap(arg0: &ProtectedTreasury): &sui::coin::TreasuryCap<SENTINEL> {
    let v0 = TreasuryCapKey {};
    sui::dynamic_object_field::borrow<TreasuryCapKey, sui::coin::TreasuryCap<SENTINEL>>(
        &arg0.id,
        v0,
    )
}

fun borrow_cap_mut(arg0: &mut ProtectedTreasury): &mut sui::coin::TreasuryCap<SENTINEL> {
    let v0 = TreasuryCapKey {};
    sui::dynamic_object_field::borrow_mut<TreasuryCapKey, sui::coin::TreasuryCap<SENTINEL>>(
        &mut arg0.id,
        v0,
    )
}

fun create_coin(
    arg0: SENTINEL,
    arg1: u64,
    arg2: &mut sui::tx_context::TxContext,
): (ProtectedTreasury, sui::coin::Coin<SENTINEL>) {
    let (v0, v1) = sui::coin::create_currency<SENTINEL>(
        arg0,
        DECIMALS,
        SYMBOL,
        NAME,
        DESCRIPTION,
        std::option::some<sui::url::Url>(
            sui::url::new_unsafe_from_bytes(ICON_URL),
        ),
        arg2,
    );
    let mut cap = v0;
    sui::transfer::public_freeze_object<sui::coin::CoinMetadata<SENTINEL>>(v1);
    let mut protected_treasury = ProtectedTreasury { id: sui::object::new(arg2) };

    let coin = sui::coin::mint<SENTINEL>(&mut cap, arg1, arg2);
    sui::dynamic_object_field::add<TreasuryCapKey, sui::coin::TreasuryCap<SENTINEL>>(
        &mut protected_treasury.id,
        TreasuryCapKey {},
        cap,
    );

    (protected_treasury, coin)
}

#[allow(lint(share_owned))]
fun init(arg0: SENTINEL, arg1: &mut TxContext) {
    let (v0, v1) = create_coin(arg0, TOTAL_SUPPLY, arg1);
    sui::transfer::share_object<ProtectedTreasury>(v0);
    sui::transfer::public_transfer<sui::coin::Coin<SENTINEL>>(v1, sui::tx_context::sender(arg1));
}



#[test_only]
public fun share_treasury_for_testing(ctx: &mut sui::tx_context::TxContext) {
    let (v0, v1) = create_coin(SENTINEL {}, 10000000000000000, ctx);
    sui::transfer::share_object<ProtectedTreasury>(v0);
    v1.burn_for_testing();
}
