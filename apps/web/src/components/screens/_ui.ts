// design 의 UI 프리미티브/아이콘은 @ts-nocheck 라 타입이 없으므로 any 로 취급한다.
// (각 화면의 도메인 데이터 흐름은 정상적으로 타입 검사된다.)
import { Icon as IconMod } from "@/design/icons";
import * as UIMod from "@/design/ui";

export const UI = UIMod as any;
export const Icon = IconMod as any;
