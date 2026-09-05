<#macro content>
  <#if properties.eumgilAppUrl?has_content>
  <footer class="eumgil-footer">
    <a href="${properties.eumgilAppUrl}">${msg("eumgilBack")}</a>
    <nav aria-label="${msg('eumgilPolicy')}">
      <a href="${properties.eumgilAppUrl}/doc?type=terms">${msg("eumgilTerms")}</a>
      <a href="${properties.eumgilAppUrl}/doc?type=privacy">${msg("eumgilPrivacy")}</a>
    </nav>
  </footer>
  </#if>
</#macro>
