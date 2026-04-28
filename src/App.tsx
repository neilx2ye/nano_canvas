import {
  CanvasProvider,
  ConfigProvider,
  TokenProvider,
} from "./contexts";
import MainPage from "./pages/MainPage";

function App() {
  return (
    <CanvasProvider>
      <ConfigProvider>
        <TokenProvider>
          <MainPage />
        </TokenProvider>
      </ConfigProvider>
    </CanvasProvider>
  );
}

export default App;
