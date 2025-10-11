const fs = require('fs');
const path = require('path');

// Base SVG template for the car wash icon
const createSVGIcon = (size, isShortcut = false, shortcutType = '') => {
  const iconColor = '#1976d2';
  const backgroundColor = '#ffffff';

  // Different icon content based on type
  let iconContent = '';

  if (isShortcut) {
    switch (shortcutType) {
      case 'booking':
        iconContent = `
          <circle cx="${size/2}" cy="${size/3}" r="${size/8}" fill="${iconColor}" opacity="0.8"/>
          <rect x="${size/3}" y="${size/2}" width="${size/3}" height="${size/6}" rx="${size/20}" fill="${iconColor}"/>
          <text x="${size/2}" y="${size*0.8}" text-anchor="middle" font-family="Arial" font-size="${size/12}" fill="${iconColor}">📅</text>
        `;
        break;
      case 'services':
        iconContent = `
          <rect x="${size/4}" y="${size/4}" width="${size/2}" height="${size/2}" rx="${size/16}" fill="${iconColor}" opacity="0.8"/>
          <circle cx="${size/2}" cy="${size/2}" r="${size/8}" fill="${backgroundColor}"/>
          <text x="${size/2}" y="${size*0.55}" text-anchor="middle" font-family="Arial" font-size="${size/8}" fill="${iconColor}">🚗</text>
        `;
        break;
      case 'contact':
        iconContent = `
          <circle cx="${size/2}" cy="${size/2}" r="${size/3}" fill="${iconColor}" opacity="0.8"/>
          <text x="${size/2}" y="${size*0.6}" text-anchor="middle" font-family="Arial" font-size="${size/6}" fill="${backgroundColor}">📞</text>
        `;
        break;
      case 'gallery':
        iconContent = `
          <rect x="${size/5}" y="${size/5}" width="${size*0.6}" height="${size*0.6}" rx="${size/20}" fill="${iconColor}" opacity="0.8"/>
          <text x="${size/2}" y="${size*0.6}" text-anchor="middle" font-family="Arial" font-size="${size/6}" fill="${backgroundColor}">🖼️</text>
        `;
        break;
    }
  } else {
    // Main app icon - car wash theme
    iconContent = `
      <!-- Car body -->
      <ellipse cx="${size/2}" cy="${size*0.55}" rx="${size*0.35}" ry="${size*0.15}" fill="${iconColor}"/>
      <!-- Car windows -->
      <ellipse cx="${size/2}" cy="${size*0.45}" rx="${size*0.25}" ry="${size*0.08}" fill="${backgroundColor}" opacity="0.9"/>
      <!-- Water drops -->
      <circle cx="${size*0.2}" cy="${size*0.3}" r="${size*0.04}" fill="#4FC3F7"/>
      <circle cx="${size*0.8}" cy="${size*0.25}" r="${size*0.03}" fill="#4FC3F7"/>
      <circle cx="${size*0.15}" cy="${size*0.7}" r="${size*0.03}" fill="#4FC3F7"/>
      <circle cx="${size*0.85}" cy="${size*0.65}" r="${size*0.04}" fill="#4FC3F7"/>
      <!-- Shine effect -->
      <ellipse cx="${size*0.4}" cy="${size*0.4}" rx="${size*0.08}" ry="${size*0.02}" fill="${backgroundColor}" opacity="0.6"/>
    `;
  }

  return `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${backgroundColor}" rx="${size/10}"/>
  ${iconContent}
</svg>`;
};

// Create Apple touch icon (180x180)
const createAppleTouchIcon = () => {
  const size = 180;
  return createSVGIcon(size);
};

// Function to convert SVG to PNG-like data URL (simplified for demo)
const svgToDataURL = (svgString) => {
  return `data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')}`;
};

// Create a simple PNG placeholder function
const createPNGPlaceholder = (size, type = 'main', shortcutType = '') => {
  const isShortcut = type === 'shortcut';
  const svg = createSVGIcon(size, isShortcut, shortcutType);

  // For now, we'll create SVG files that can be converted to PNG later
  // In a real implementation, you'd use a library like sharp or canvas to generate PNGs
  return svg;
};

// Icon sizes to generate
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
const shortcutTypes = ['booking', 'services', 'contact', 'gallery'];

// Create main app icons
iconSizes.forEach(size => {
  const svg = createPNGPlaceholder(size);
  const filename = `icon-${size}x${size}.svg`;
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'icons', filename), svg);
  console.log(`Created ${filename}`);
});

// Create Apple touch icon
const appleTouchIcon = createAppleTouchIcon();
fs.writeFileSync(path.join(__dirname, '..', 'public', 'icons', 'apple-touch-icon.svg'), appleTouchIcon);
console.log('Created apple-touch-icon.svg');

// Create shortcut icons
shortcutTypes.forEach(type => {
  const svg = createPNGPlaceholder(96, 'shortcut', type);
  const filename = `shortcut-${type}.svg`;
  fs.writeFileSync(path.join(__dirname, '..', 'public', 'icons', filename), svg);
  console.log(`Created ${filename}`);
});

// Create a basic favicon
const favicon = createPNGPlaceholder(32);
fs.writeFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'), favicon);
console.log('Created favicon.svg');

console.log('\n✅ Icon generation complete!');
console.log('Note: SVG files created as placeholders. For production, convert these to PNG format.');
console.log('You can use online tools or libraries like sharp to convert SVG to PNG.');

// Create a README for the icons
const iconReadme = `# PWA Icons

This directory contains all the icons needed for the Progressive Web App.

## Generated Icons:
- icon-[size]x[size].svg - Main app icons in various sizes
- apple-touch-icon.svg - Apple touch icon (180x180)
- shortcut-[type].svg - App shortcut icons
- favicon.svg - Favicon

## For Production:
Convert these SVG files to PNG format using tools like:
- sharp (Node.js library)
- imagemagick
- Online SVG to PNG converters
- Design tools (Figma, Sketch, etc.)

## Required PNG Sizes:
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
- Apple touch icon: 180x180
- Shortcut icons: 96x96
- Favicon: 32x32, 16x16

## Design Guidelines:
- Use the brand colors: Primary #1976d2, White #ffffff
- Include car wash theme elements
- Ensure icons work on both light and dark backgrounds
- Follow platform-specific design guidelines (iOS, Android)
`;

fs.writeFileSync(path.join(__dirname, '..', 'public', 'icons', 'README.md'), iconReadme);
console.log('Created icons/README.md');