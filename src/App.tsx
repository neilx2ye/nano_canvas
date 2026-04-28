import {
  CanvasProvider,
  ConfigProvider,
  ProjectArchiveProvider,
  TokenProvider,
} from "./contexts";
import MainPage from "./pages/MainPage";

function App() {
  return (
    <CanvasProvider>
      <ConfigProvider>
        <ProjectArchiveProvider>
          <TokenProvider>
            <MainPage />
          </TokenProvider>
        </ProjectArchiveProvider>
      </ConfigProvider>
    </CanvasProvider>
  );
}

export default App;
