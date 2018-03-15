<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.1" xmlns="http://relaxng.org/ns/structure/1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:rng="http://relaxng.org/ns/structure/1.0" xmlns:exsl="http://exslt.org/common" exclude-result-prefixes="rng exsl">

<xsl:output method="xml"/>

<!-- 7.19
The names of the named patterns are then changed so as to be unique across the whole schema; the references to these named patterns are changed accordingly.

A top-level grammar and its start element are created, if not already present. All the named patterns become children in this top-level grammar, parentRef elements are replaced by ref elements, and all other grammar and start elements are replaced by their child elements.
 -->

<xsl:template match="*|text()|@*">
	<xsl:copy>
		<xsl:apply-templates select="@*"/>
		<xsl:apply-templates/>
	</xsl:copy>
</xsl:template>

<xsl:template match="/rng:grammar">
	<grammar>
		<xsl:apply-templates/>
    <!-- We do our children first so that they appear first. -->
		<xsl:apply-templates select="rng:define" mode="step7.19-define"/>
		<xsl:apply-templates select="*//rng:define" mode="step7.19-define"/>
	</grammar>
</xsl:template>

<xsl:template match="/*[not(self::rng:grammar)]">
  <!-- Wrap in a new grammar element, and then process as in the default
       case. -->
  <xsl:variable name="new-grammar">
	  <grammar>
		  <start>
			  <xsl:copy-of select="."/>
		  </start>
	  </grammar>
  </xsl:variable>
  <xsl:apply-templates select="exsl:node-set($new-grammar)"/>
</xsl:template>

<xsl:template match="rng:define|rng:define/@name|rng:ref/@name|rng:parentRef/@name"/>

<!--
    We've replaced Nicolas' generate-id() with an id generation which is based
    on the location of the containing grammar element. Given the a grammar
    element, the grammar's id is the number of grammar elements that appear
    before it in document reading order, plus 1.
-->
<xsl:template name="grammar-id">
  <xsl:param name="node" select="."/>
  <xsl:variable name="containing-grammar" select="$node/ancestor::rng:grammar[1]"/>
  <xsl:value-of select="count($containing-grammar/preceding::rng:grammar | $containing-grammar/ancestor::rng:grammar) + 1"/>
</xsl:template>

<xsl:template match="rng:define" mode="step7.19-define">
  <xsl:variable name="grammar-id">
    <xsl:call-template name="grammar-id"/>
  </xsl:variable>
	<define name="{@name}-gr-{$grammar-id}">
		<xsl:apply-templates select="@*"/>
		<xsl:apply-templates/>
	</define>
</xsl:template>

<xsl:template match="rng:grammar">
	<xsl:apply-templates select="rng:start/*"/>
</xsl:template>

<xsl:template match="rng:ref">
  <xsl:variable name="grammar-id">
    <xsl:call-template name="grammar-id"/>
  </xsl:variable>
	<ref name="{@name}-gr-{$grammar-id}">
		<xsl:apply-templates select="@*"/>
		<xsl:apply-templates/>
	</ref>
</xsl:template>

<xsl:template match="rng:parentRef">
  <xsl:variable name="grammar-id">
    <xsl:call-template name="grammar-id">
      <!-- We have to get the id of the grammar which *contains* the grammar
           that contains the reference. -->
      <xsl:with-param name="node" select="ancestor::rng:grammar[1]"/>
    </xsl:call-template>
  </xsl:variable>
	<ref name="{@name}-gr-{$grammar-id}">
		<xsl:apply-templates select="@*"/>
		<xsl:apply-templates/>
	</ref>
</xsl:template>

</xsl:stylesheet>
