<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet
    xmlns:xhtml="http://www.w3.org/1999/xhtml"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:xs="http://www.w3.org/2001/XMLSchema"
    xmlns:in="internal"
    xmlns:internal="internal"
    exclude-result-prefixes="xs"
    version="2.0">

  <xsl:preserve-space  elements="*"/>

  <xsl:output method="xml" indent="no"/>

  <xsl:template match="/">
    <xsl:apply-templates select="//testCase"/>
  </xsl:template>

  <xsl:template match="node()|@*">
    <xsl:copy>
      <xsl:apply-templates select="node()|@*"/>
    </xsl:copy>
  </xsl:template>

  <xsl:template match="correct|incorrect|valid|invalid">
    <xsl:apply-templates select="node()|@*"/>
  </xsl:template>

  <xsl:template name="makeResource">
    <xsl:param name="outdir"/>
    <xsl:variable name="pdir"
                  select="string-join((ancestor::dir)/@name, '/')"/>
    <xsl:variable name="parent-path"
                  select="if ($pdir) then concat($pdir, '/') else ''"/>
    <xsl:result-document href="{$outdir}/{$parent-path}{@name}">
      <xsl:apply-templates select="*"/>
    </xsl:result-document>
  </xsl:template>

  <xsl:template match="testCase">
    <xsl:variable name="outdir" select="concat('spectest/test', count(preceding::testCase) + 1)"/>
    <xsl:for-each select="correct">
      <xsl:result-document href="{$outdir}/correct{position()}.rng">
        <xsl:apply-templates select="."/>
      </xsl:result-document>
    </xsl:for-each>
    <xsl:for-each select="incorrect">
      <xsl:result-document href="{$outdir}/incorrect{position()}.rng">
        <xsl:apply-templates select="."/>
      </xsl:result-document>
    </xsl:for-each>
    <xsl:for-each select="valid">
      <xsl:result-document href="{$outdir}/valid{position()}.xml">
        <xsl:apply-templates select="."/>
      </xsl:result-document>
    </xsl:for-each>
    <xsl:for-each select="invalid">
      <xsl:result-document href="{$outdir}/invalid{position()}.xml">
        <xsl:apply-templates select="."/>
      </xsl:result-document>
    </xsl:for-each>
    <xsl:for-each select=".//resource">
      <xsl:call-template name="makeResource">
        <xsl:with-param name="outdir" select="$outdir"/>
      </xsl:call-template>
    </xsl:for-each>
  </xsl:template>

</xsl:stylesheet>
