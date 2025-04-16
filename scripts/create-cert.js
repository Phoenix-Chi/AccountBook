const crypto = require('crypto');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

function generateCertificate() {
  try {
    const certDir = path.join(__dirname, '../certificates');
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
      console.log('Created certificates directory');
    }

    // 生成 RSA 密钥对
    const keys = forge.pki.rsa.generateKeyPair(2048);
    
    // 创建证书
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [{
      name: 'commonName',
      value: 'localhost'
    }, {
      name: 'countryName',
      value: 'CN'
    }, {
      shortName: 'ST',
      value: 'Local'
    }, {
      name: 'localityName',
      value: 'Local'
    }, {
      name: 'organizationName',
      value: 'Development CA'
    }, {
      shortName: 'OU',
      value: 'Development'
    }];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // 获取本机IP地址
    const interfaces = require('os').networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }

    // 设置证书扩展
    const altNames = [{
      type: 2, // DNS
      value: 'localhost'
    }, {
      type: 7, // IP
      ip: '127.0.0.1'
    }];
    
    // 添加所有本机IP地址
    ips.forEach(ip => {
      altNames.push({
        type: 7, // IP
        ip: ip
      });
    });

    cert.setExtensions([{
      name: 'basicConstraints',
      cA: true
    }, {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true
    }, {
      name: 'subjectAltName',
      altNames: altNames
    }]);

    // 使用私钥签名证书
    cert.sign(keys.privateKey, forge.md.sha256.create());

    // 转换为 PEM 格式
    const certPem = forge.pki.certificateToPem(cert);
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);

    // 保存证书和私钥
    fs.writeFileSync(path.join(certDir, 'cert.crt'), certPem);
    fs.writeFileSync(path.join(certDir, 'cert.key'), privateKeyPem);

    console.log('Certificates created successfully!');
  } catch (err) {
    console.error('Error generating certificates:', err);
    process.exit(1);
  }
}

generateCertificate();