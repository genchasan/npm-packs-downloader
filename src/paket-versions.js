const cache = require("./cache");

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

async function getPackageVersions(packageName, packageVersion, deepTree = false, maxLevel = 1) {
    try {
        let vers = [];

        await getPackageVersionRecursive(packageName, packageVersion, deepTree, 0, maxLevel, vers);

        return reduceVersions(vers);
    } catch (error) {
        console.error(`Paket bilgileri alınamadı (${packageName}@${packageVersion}):`, error.message);
        throw error;
    }
}

async function getPackageVersionRecursive(packageName, packageVersion, deepTree = false, level = 0, maxLevel = 1, vers = []) {
    let lokalLevel = level + 1;

    let {latestVersion, allVersions} = await getPackagesInfo(`${packageName}`);

    if (packageVersion === undefined) {
        packageVersion = latestVersion;
    }
    if (allVersions === undefined) return;

    const uygunVersiyon = semver.maxSatisfying(Object.entries(allVersions).map(p => p[1][0]), packageVersion);
    let uygunPack = undefined
    if (uygunVersiyon) {
        uygunPack = Object.entries(allVersions).find(p => p[1][0] === uygunVersiyon)[1][1];
        vers.push({name: uygunPack.name, version: uygunPack.version, url: uygunPack.dist.tarball, level: lokalLevel});
        try {
            let cleanVersion = semver.minVersion(packageVersion).version;
            if (cleanVersion !== uygunVersiyon) {
                let cleanVerPack = Object.entries(allVersions)
                                    .find(p => p[1][0] === cleanVersion);
                if (cleanVerPack) {
                    vers.push({
                        name: cleanVerPack[1][1].name,
                        version: cleanVersion,
                        url: cleanVerPack[1][1].dist.tarball,
                        level: lokalLevel
                    });
                }
            }
        } catch (e) {
            logger.error(e)
        }
    } else return;

    if (lokalLevel > maxLevel) return; // Daha derine inmeden sonrakine gec

    const dependencies = uygunPack.dependencies || {};
    const devDependencies = uygunPack.devDependencies || {};
    const peerDependencies = uygunPack.peerDependencies || {};

    const altDeps = [...Object.entries(dependencies),
        ...Object.entries(devDependencies), ...Object.entries(peerDependencies)]
        .map(function (val) {
        return { name: val[0], version: val[1] };
    });

    for (const { name, version }  of Object.values(altDeps)) {
        await getPackageVersionRecursive(name, version, deepTree, lokalLevel, maxLevel, vers);
    }
}

module.exports = {
    getPackageVersions,
    arePacketsEqual,
    reduceVersions
};
