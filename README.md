# PEO Bridge Building Competition

A web application for managing the PEO Bridge Building Competition, including participant check-in, judging, and leaderboard functionality.

## Features

- Real-time participant check-in
- Judging interface with scoring criteria
- Live leaderboard for both Junior and Senior categories
- Admin panel for participant management
- CSV import functionality
- Test data generation

## Tech Stack

- TypeScript
- Firebase (Firestore)
- Webpack
- HTML5/CSS3

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/PEO-Brampton/PEO.git
cd PEO
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Build for production:
```bash
npm run build
```

5. Deploy to GitHub Pages:
```bash
npm run deploy
```

## Development

The application is structured as follows:

- `src/` - Source files
  - `index.ts` - Main application logic
  - `firebase.ts` - Firebase configuration
  - `types.ts` - TypeScript type definitions
  - `styles.css` - Application styles
  - `index.html` - Main HTML template

## Deployment

The application is deployed to GitHub Pages at:
https://peo-brampton.github.io/PEO/

## License

This project is licensed under the MIT License. 