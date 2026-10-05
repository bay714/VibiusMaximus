// Storyboard stills for the Legion rework. Separate from the HowTo video:
//   bunx remotion render src/storyboard/index.ts Frames out/storyboard --sequence --image-format=png
//   bunx remotion still src/storyboard/index.ts Sheet out/storyboard/sheet.png
import { registerRoot } from "remotion";
import { Root } from "./Root";

registerRoot(Root);
