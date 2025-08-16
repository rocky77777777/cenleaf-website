const { createCanvas } = require('canvas');
const fs = require('fs');

function createFavicon(size, filename) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // 背景（青い四角）
    ctx.fillStyle = '#007acc';
    const radius = size * 0.125;
    
    // 角丸の四角を描画
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();
    
    // 白いテキスト「C」
    ctx.fillStyle = 'white';
    ctx.font = `bold ${size * 0.625}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('C', size/2, size/2 + size * 0.05);
    
    // PNGとして保存
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filename, buffer);
    console.log(`✅ ${filename} を作成しました (${size}x${size})`);
}

// 各サイズのファビコンを生成
createFavicon(32, 'favicon.png');
createFavicon(180, 'apple-touch-icon.png');
createFavicon(16, 'favicon-16x16.png');

console.log('\n🎉 すべてのファビコンを生成しました！');