import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import CropTypePage from './pages/CropTypePage';
import PreviewPage from './pages/PreviewPage';
import ResultPage from './pages/ResultPage';
import { useState } from 'react';
import {
  DEFAULT_HELMET_PRESET_ID,
  DEFAULT_OUTFIT_PRESET_ID,
  DEFAULT_WEAPON_PRESET_ID,
} from './constants/cropPresets';

function NavBar({ uploadedFiles, outputs, cropType }) {
  const location = useLocation();
  const path = location.pathname;

  const steps = [
    { path: '/', label: 'Upload', num: '1' },
    { path: '/crop-type', label: 'Loại cắt', num: '2' },
    { path: '/preview', label: 'Preview', num: '3' },
    { path: '/result', label: 'Result', num: '4' },
  ];

  const stepOrder = steps.map(s => s.path);
  const currentIdx = stepOrder.indexOf(path);

  const getStepClass = (stepPath, idx) => {
    if (path === stepPath) return 'nav-step active';
    if (idx < currentIdx) return 'nav-step completed';
    return 'nav-step';
  };

  const getConnectorClass = (idx) => {
    if (idx < currentIdx) return 'nav-step-connector active';
    return 'nav-step-connector';
  };

  const getStepNum = (step, idx) => {
    if (idx < currentIdx) return '✓';
    return step.num;
  };

  return (
    <nav className="nav">
      <div className="nav-inner">
        <NavLink to="/" className="nav-logo">
          <div className="nav-logo-icon">🎮</div>
          PUBG Showcase
        </NavLink>
        <div className="nav-steps">
          {steps.map((step, idx) => (
            <React.Fragment key={step.path}>
              <NavLink to={step.path} className={getStepClass(step.path, idx)}>
                <span className="nav-step-num">{getStepNum(step, idx)}</span>
                <span>{step.label}</span>
              </NavLink>
              {idx < steps.length - 1 && (
                <div className={getConnectorClass(idx)} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [outputs, setOutputs] = useState([]);
  const [cropType, setCropType] = useState('outfit');
  const [outfitPreset, setOutfitPreset] = useState(DEFAULT_OUTFIT_PRESET_ID);
  const [weaponPreset, setWeaponPreset] = useState(DEFAULT_WEAPON_PRESET_ID);
  const [helmetPreset, setHelmetPreset] = useState(DEFAULT_HELMET_PRESET_ID);
  const [customGrid, setCustomGrid] = useState(null);
  const [detectLevel, setDetectLevel] = useState(false);

  return (
    <BrowserRouter>
      <div className="app">
        <NavBar uploadedFiles={uploadedFiles} outputs={outputs} cropType={cropType} />
        <main className="main-content">
          <Routes>
            <Route
              path="/"
              element={<UploadPage uploadedFiles={uploadedFiles} setUploadedFiles={setUploadedFiles} />}
            />
            <Route
              path="/crop-type"
              element={
                <CropTypePage
                  uploadedFiles={uploadedFiles}
                  cropType={cropType}
                  setCropType={setCropType}
                  outfitPreset={outfitPreset}
                  setOutfitPreset={setOutfitPreset}
                  weaponPreset={weaponPreset}
                  setWeaponPreset={setWeaponPreset}
                  helmetPreset={helmetPreset}
                  setHelmetPreset={setHelmetPreset}
                  customGrid={customGrid}
                  setCustomGrid={setCustomGrid}
                  detectLevel={detectLevel}
                  setDetectLevel={setDetectLevel}
                />
              }
            />
            <Route
              path="/preview"
              element={
                <PreviewPage
                  uploadedFiles={uploadedFiles}
                  setOutputs={setOutputs}
                  cropType={cropType}
                  outfitPreset={outfitPreset}
                  weaponPreset={weaponPreset}
                  helmetPreset={helmetPreset}
                  customGrid={customGrid}
                  detectLevel={detectLevel}
                />
              }
            />
            <Route
              path="/result"
              element={<ResultPage outputs={outputs} cropType={cropType} />}
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
