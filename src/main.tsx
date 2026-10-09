import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Root from '@/components/console/root'

import ErrorPage from './error-page.tsx'

import {GlobalProvider} from "@/components/console/global-context"
import AuthLogin from "@/components/console/authLogin"
import AuthRegister from '@/components/console/authRegister';
import AuthConfirm from "@/components/console/authConfirm"
import AuthInvite from "@/components/console/authInvite"
import Account from "@/components/console/account"
import Extensions from "@/components/console/extensions"
import ForgotPassword from '@/components/console/authForgotPassword.tsx';
import ResetPassword from '@/components/console/authResetPassword.tsx';

import Landing from './landing/Landing.tsx';

import ToolRouter from "@/router.tsx"

import AppSettings from "@/components/console/app_settings"
import SettingsTeams from "@/components/console/settings-teams"
import SettingsExtensions from "@/components/console/settings-extensions"
import SettingsOrgs from "@/components/console/settings-orgs"
import SettingsHome from "@/components/console/settings-home"
import HomePage from "@/components/console/home/home-page"
import Token from "@/components/console/token"

import './index.css'


const isAuthenticated = () => {
  const accessToken = sessionStorage.getItem('accessToken');
  return !!accessToken;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalProvider>
      <BrowserRouter basename="/">
        <Routes>
          <Route path="/" element={<Navigate replace to="/login" />} />
          <Route 
            path="/" 
            element={isAuthenticated() ? <Root /> : <Navigate replace to="/login" />}
            errorElement={<ErrorPage />}
          >
            <Route path="/home" element={isAuthenticated() ? <HomePage /> : <Navigate replace to="/login" />} />
            <Route path="/account" element={isAuthenticated() ? <Account /> : <Navigate replace to="/login" />} />
            <Route path="/extensions" element={isAuthenticated() ? <Extensions /> : <Navigate replace to="/login" />} />
            <Route path=":portfolio/settings" element={isAuthenticated() ? <AppSettings /> : <Navigate replace to="/login" />}>
              <Route index element={<SettingsExtensions />} />
              <Route path="teams" element={<SettingsTeams />} />
              <Route path="orgs" element={<SettingsOrgs />} />
              <Route path="tools" element={<SettingsExtensions />} />
              <Route path="extensions" element={<SettingsExtensions />} />
              <Route path="portfolios" element={<SettingsHome />} />
            </Route>
            <Route path=":portfolio/:org/:tool" element={isAuthenticated() ? <ToolRouter /> : <Navigate replace to="/login" />} />
            <Route path=":portfolio/:org/:tool/:section" element={isAuthenticated() ? <ToolRouter /> : <Navigate replace to="/login" />} />
            <Route path=":portfolio/:org/:tool/:section/:p1" element={isAuthenticated() ? <ToolRouter /> : <Navigate replace to="/login" />} />
            <Route path=":portfolio/:org/:tool/:section/:p1/:p2" element={isAuthenticated() ? <ToolRouter /> : <Navigate replace to="/login" />} />
            <Route path=":portfolio/:org/:tool/:section/:p1/:p2/:p3" element={isAuthenticated() ? <ToolRouter /> : <Navigate replace to="/login" />} />
          </Route>
          <Route path="/login" element={<AuthLogin />} />
          <Route path="/register" element={<AuthRegister />} />
          <Route path="/confirm" element={<AuthConfirm />} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="/invite" element={<AuthInvite />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/token" element={<Token />} />
        </Routes>
      </BrowserRouter>
    </GlobalProvider>
  </StrictMode>,
)
