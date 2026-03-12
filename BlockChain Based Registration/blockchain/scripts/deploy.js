async function main() {
    const [deployer] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory('TouristRegistry');
    const registry = await Registry.deploy();

    await registry.deployed();
    console.log('Deployed at:', registry.address);
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
