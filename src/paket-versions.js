// getPackageVersions.js
const getPackagesInfo = require('./paket-info');
const semver = require("semver");
const {logger} = require("./logger");

function arePacketsEqual(obj1, obj2) {
    return obj1.name === obj2.name && obj1.version === obj2.version;
}

function reduceVersions(versions) {
    let ret = [];
    versions.forEach(function (val) {
        if (!ret.some((u) => { return arePacketsEqual(val, u);}))
            ret.push(val);
    });

    return ret;
}

async function getPackageVersions(packageName, packageVersion, deepTree = false, maxLevel = 1, excludes = []) {
    try {
        let vers = [];

        await getPackageVersionRecursive(packageName, packageVersion, deepTree, 0, maxLevel, vers, excludes);

        return reduceVersions(vers);
    } catch (error) {
        logger.error(`Paket bilgileri alınamadı (${packageName}@${packageVersion}):`, error.message);
        throw error;
    }
}

async function getPackageVersionRecursive(packageName, packageVersion, deepTree = false, level = 0,
                                          maxLevel = 1, vers = [], excludes = []) {
    let lokalLevel = level + 1;

    let {latestVersion, allVersions} = await getPackagesInfo(`${packageName}`);

    if (packageVersion === undefined) {
        packageVersion = latestVersion;
    }
    if (allVersions === undefined) return;

    let entries = [...Object.values(allVersions).filter(p => semver.satisfies(p[0], packageVersion)).entries()];

    for( let [ ,[ , uygunPack] ] of entries) {
        vers.push({name: uygunPack.name, version: uygunPack.version, url: uygunPack.dist.tarball, level: lokalLevel});

        if (lokalLevel > maxLevel) return; // Daha derine inmeden sonrakine gec

        const dependencies = uygunPack.dependencies || {};
        const devDependencies = uygunPack.devDependencies || {};
        const peerDependencies = uygunPack.peerDependencies || {};

        const altDeps = [...Object.entries(dependencies),
            ...Object.entries(devDependencies), ...Object.entries(peerDependencies)]
            .filter((val) => {
                return !excludes.includes(val[0])
            }).map(function (val) {
                return {name: val[0], version: val[1]};
            });

        for (const {name, version} of Object.values(altDeps)) {
            await getPackageVersionRecursive(name, version, deepTree, lokalLevel, maxLevel, vers, excludes);
        }
    }
}

module.exports = {
    getPackageVersions,
    arePacketsEqual,
    reduceVersions
};
