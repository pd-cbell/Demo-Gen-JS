# PD Demo Agent Frontend

This directory contains the React-based UI microservice for the PD Demo Agent application. It provides:
  - A **Dashboard** to select incident scenarios (major, partial, well) and generate narratives & event payloads via the backend API.
  - An **Event Sender** to send generated event payloads to PagerDuty with live schedule summaries and send results.
  - A **Preview** interface to browse, view, edit, and download generated files per organization.

The frontend runs on port **3000** by default and communicates with the backend service at `http://localhost:5002`.

## Prerequisites
  - Node.js (>=16.x)
  - npm (>=8.x)

## Installation
1. Change into this directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

Ensure that the backend API service is running at `http://localhost:5002` before starting the frontend.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

## Docker
This project includes a Dockerfile for running the frontend in a container:

1. Build the Docker image:
   ```bash
   docker build -t pd-demo-agent-frontend .
   ```
2. Run the container:
   ```bash
   docker run -it --rm -p 3000:3000 pd-demo-agent-frontend
   ```
The app will be accessible at [http://localhost:3000](http://localhost:3000).

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

