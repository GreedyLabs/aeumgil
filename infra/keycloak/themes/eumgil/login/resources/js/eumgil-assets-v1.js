// 기본 템플릿은 유지하고, 교체된 아이콘이 브라우저·CDN의 이전 캐시에 가리지 않게 한다.
for (const icon of document.querySelectorAll('link[rel="icon"]')) {
  const url = new URL(icon.href);
  url.searchParams.set("v", "bb99f1d9");
  icon.href = url.href;
}
