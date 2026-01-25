# Deployment Guide - Argos Funding Engine

Since this module is integrated into your GitHub repository, the easiest way to deploy it for embedding is using **Streamlit Community Cloud**.

## Steps to Deploy

1.  **Go to Streamlit Cloud**:
    - Visit [share.streamlit.io](https://share.streamlit.io/) and log in with GitHub.

2.  **New App**:
    - Click **"New app"**.
    - **Repository**: Select `augustomartinez87/portfolio-tracker-argos`.
    - **Branch**: `main`.
    - **Main file path**: `funding_engine/app.py`.

3.  **Advanced Settings (Environment Variables)**:
    - Click "Advanced settings" before deploying.
    - Add your Supabase secrets here so the app can connect to the real DB:
        - `SUPABASE_URL`: `your_supabase_url`
        - `SUPABASE_KEY`: `your_supabase_anon_key`
        - `STREAMLIT_TOKEN`: `argos-access` (Optional, for token auth if implemented)

4.  **Deploy**:
    - Click **"Deploy!"**.
    - Wait a moment (it will install dependencies from `funding_engine/requirements.txt`).

## Integration in React

Once deployed, you will get a URL like `https://argos-funding-engine.streamlit.app`. Use this in your React iframe:

```jsx
// src/pages/FundingEngine.jsx

const FundingEngineEmbed = ({ portfolioId }) => {
  const baseUrl = "https://[YOUR-APP-URL].streamlit.app";
  const token = "argos-access"; // If using auth
  
  // Dynamic Dates (e.g. Last 30 days)
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const src = `${baseUrl}/?embedded=true&token=${token}&portfolio_id=${portfolioId}&date_from=${startDate}&date_to=${endDate}`;

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <iframe
        src={src}
        width="100%"
        height="100%"
        frameBorder="0"
        style={{ background: '#0E1117' }} // Blend with background
      />
    </div>
  );
};
```
