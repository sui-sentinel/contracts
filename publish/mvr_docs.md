# What is Move Registry

What is the Move Registry?
Move Registry (MVR, pronounced mover) provides a uniform naming service for interacting and building with packages from the Sui ecosystem. This means that you can reference packages by their names, and MVR resolves the package address for you, despite the network.

You can access the front end of the Move Registry online at https://www.moveregistry.com/apps.

Use MVR to:

Reference both packages and types by name in programmable transaction blocks (PTBs).

Depend on other packages when developing with Move.

Additionally, MVR can help you manage package versioning. With MVR, you call a specific version of a package without having to resolve the addresses yourself. You also do not need to worry about the package being updated, because if you use a name without a specified version, MVR automatically defaults to the latest version available.


Docs link
https://docs.suins.io/move-registry

```
const transaction = new Transaction();
// ... (other code, could also include a `transaction.publish()`
// call to publish & register in one step.)

/// We pass in our UpgradeCap
const packageInfo = transaction.moveCall({
target: `@mvr/metadata::package_info::new`,
arguments: [transaction.object('<Your UpgradeCap (by value or object id)>')],
});

// We also need to create the visual representation of our "info" object.
// You can also call `@mvr/metadata::display::new` instead,
// that allows customizing the colors of your metadata object!
const display = transaction.moveCall({
target: `@mvr/metadata::display::default`,
arguments: [
transaction.pure.string('<Add a name to easily identify your package. This is not your MVR name.>') // Example: core
],
});

// Set that display object to our info object.
transaction.moveCall({
target: `@mvr/metadata::package_info::set_display`,
arguments: [transaction.object(packageInfo), display],
});

// Set the default for the packageInfo, which enables reverse resolution for that network
// See details in reverse resolution section
transaction.moveCall({
target: "@mvr/metadata::package_info::set_metadata",
arguments: [
transaction.object(packageInfo),
transaction.pure.string("default"),
transaction.pure.string("<MVR name>"), // Example: @suins/core or suins.sui/core
],
});

// Optionally unset the metadata for the packageInfo
// transaction.moveCall({
//   target: "@mvr/metadata::package_info::unset_metadata",
//   arguments: [
//   transaction.object(packageInfo),
//   transaction.pure.string("default"),
//   ],
// });

// transfer the `PackageInfo` object to a safe address.
transaction.moveCall({
target: `@mvr/metadata::package_info::transfer`,
arguments: [transaction.object(packageInfo), transaction.pure.address('<Your safe address>')],
});

// .. you can do any other actions, like setting the source code info, in the same PTB.
```
