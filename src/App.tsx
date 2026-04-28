import {
  CanvasProvider,
  ConfigProvider,
  AutoSaveProvider,
  TokenProvider,
} from "./contexts";
import MainPage from "./pages/MainPage";

function App() {
  return (
    <CanvasProvider>
      <ConfigProvider>
        <AutoSaveProvider>
          <TokenProvider>
            <MainPage />
          </TokenProvider>
        </AutoSaveProvider>
      </ConfigProvider>
    </CanvasProvider>
  );
}

export default App;
