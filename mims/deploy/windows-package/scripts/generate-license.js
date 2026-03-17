const crypto = require('crypto');
const os = require('os');

function getMachineFingerprint() {
    const networkInterfaces = os.networkInterfaces();
    const cpus = os.cpus();
    
    // Get MAC addresses
    const macAddresses = [];
    Object.values(networkInterfaces).forEach(interfaces => {
        interfaces.forEach(iface => {
            if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
                macAddresses.push(iface.mac);
            }
        });
    });
    
    // Create machine fingerprint
    const fingerprint = {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        cpuModel: cpus[0]?.model || 'unknown',
        cpuCount: cpus.length,
        macAddresses: macAddresses.sort(),
        totalMemory: os.totalmem()
    };
    
    return fingerprint;
}

function generateLicense(machineInfo, validityDays = 365) {
    const licenseData = {
        machineInfo,
        generatedAt: new Date().toISOString(),
        validUntil: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString(),
        version: '1.0.0',
        features: ['full']
    };
    
    // Sign the license
    const licenseString = JSON.stringify(licenseData);
    const signature = crypto.createHmac('sha256', 'M1MS-L1C3NS3-K3Y-2026').update(licenseString).digest('hex');
    
    const license = {
        data: licenseData,
        signature
    };
    
    return Buffer.from(JSON.stringify(license)).toString('base64');
}

// Generate license for current machine
const machineInfo = getMachineFingerprint();
const license = generateLicense(machineInfo);

console.log('Machine Fingerprint:');
console.log(JSON.stringify(machineInfo, null, 2));
console.log('\nGenerated License:');
console.log(license);

// Save to file
require('fs').writeFileSync('license.key', license);
console.log('\nLicense saved to license.key');
