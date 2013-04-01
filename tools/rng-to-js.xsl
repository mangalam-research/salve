<xsl:stylesheet 
    xmlns="http://www.tei-c.org/ns/1.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform" 
    xmlns:xs="http://www.w3.org/2001/XMLSchema"                
    xmlns:rng="http://relaxng.org/ns/structure/1.0"
    version="1.0"
    exclude-result-prefixes="xs rng"
    >
  <xsl:output method="text"/>

  <xsl:template match="*">
    <xsl:call-template name="generate-new"/>
  </xsl:template>

  <xsl:template match="rng:grammar">
    <xsl:call-template name="generate-new"/>
  </xsl:template>

  <xsl:template match="rng:ref|rng:define">
    <xsl:call-template name="generate-new">
      <xsl:with-param name="first" select="@name"/>
      <xsl:with-param name="rest" select="*"/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="rng:ref/@name|rng:define/@name">
    <xsl:text>"</xsl:text><xsl:apply-templates/><xsl:text>"</xsl:text>
  </xsl:template>

  <xsl:template match="rng:name">
    <xsl:text>new EName("</xsl:text>
    <xsl:apply-templates select="@ns"/>
    <xsl:text>","</xsl:text>
    <xsl:apply-templates/>
    <xsl:text>")</xsl:text>
  </xsl:template>

  <xsl:template match="rng:start">
    <xsl:apply-templates select="*"/>
  </xsl:template>

  <xsl:template match="rng:group|rng:choice|rng:oneOrMore">
    <xsl:call-template name="generate-new">
      <xsl:with-param name="first" select="QQQQ"/> <!-- Empty set -->
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="*" mode="name">
    <xsl:text>/</xsl:text><xsl:value-of select="local-name()"/>
    <xsl:if test="rng:name">
      <xsl:text>[@name='</xsl:text><xsl:apply-templates select="rng:name" mode="name"/><xsl:text>']</xsl:text>
    </xsl:if>
    <xsl:if test="@name">
      <xsl:text>[@name='</xsl:text><xsl:apply-templates select="@name" mode="name"/><xsl:text>']</xsl:text>
    </xsl:if>
  </xsl:template>

  <xsl:template match="rng:name" mode="name">
    <xsl:apply-templates/>
  </xsl:template>

  <xsl:template name="generate-new">
    <xsl:param name="name" select="local-name()"/>
    <xsl:param name="first" select="*[1]"/>
    <xsl:param name="rest" select="*[position() > count($first)]"/>
    <xsl:if test="position() != 1">
      <xsl:text>, </xsl:text>
    </xsl:if>
    <xsl:call-template name="generate-new-start">
      <xsl:with-param name="name" select="$name"/>
    </xsl:call-template>
    <xsl:text>"</xsl:text><xsl:apply-templates select="ancestor-or-self::*" mode="name"/><xsl:text>"</xsl:text>
    <xsl:if test="count($first) > 0 or $rest">
      <xsl:text>, </xsl:text>
    </xsl:if>
    <xsl:if test="count($first)>0">
      <xsl:apply-templates select="$first"/>
      <xsl:if test="$rest">
	<xsl:text>, </xsl:text>
      </xsl:if>
    </xsl:if>
    <xsl:if test="$rest">
      <xsl:text>[</xsl:text><xsl:apply-templates select="$rest"/><xsl:text>]</xsl:text>
    </xsl:if>
    <xsl:text>)</xsl:text>
  </xsl:template>

  <xsl:template name="generate-new-start">
    <xsl:param name="name" select="local-name()"/>
    <xsl:text>new </xsl:text><xsl:value-of select="concat(translate(substring($name, 1, 1), 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), substring($name, 2))"/><xsl:text>(</xsl:text>
  </xsl:template>
  
</xsl:stylesheet>
