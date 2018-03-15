<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.1" xmlns="http://relaxng.org/ns/structure/1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:rng="http://relaxng.org/ns/structure/1.0" exclude-result-prefixes="rng">

<xsl:output method="xml"/>

<!-- 7.20
For each element that isn't the unique child of a define element, a named pattern is created to embed its definition.

For each named pattern that isn't embedded, a single element pattern is suppressed. References to this named pattern are replaced by its definition.
-->

<xsl:key name="define-wo-element"
         match="rng:define[not(rng:element)]" use="@name"/>

<xsl:template match="*|text()|@*">
	<xsl:copy>
		<xsl:apply-templates select="@*"/>
		<xsl:apply-templates/>
	</xsl:copy>
</xsl:template>

<xsl:template match="/rng:grammar">
	<xsl:copy>
		<xsl:apply-templates select="@*"/>
		<xsl:apply-templates/>
		<xsl:apply-templates select="//rng:element[not(parent::rng:define)]" mode="step7.20-define"/>
	</xsl:copy>
</xsl:template>

<xsl:template match="rng:element" mode="step7.20-define">
  <!-- The code here originally used generate-id() but generate-id() is not
       necessarily stable from run to run, and it is meant to be opaque. -->
  <define name="__{rng:name}-elt-{count(preceding::rng:element | ancestor::rng:element) + 1}">
		<xsl:copy>
			<xsl:apply-templates select="@*"/>
			<xsl:apply-templates/>
		</xsl:copy>
	</define>
</xsl:template>

<xsl:template match="rng:element[not(parent::rng:define)]">
  <!-- The code here originally used generate-id() but generate-id() is not
       necessarily stable from run to run, and it is meant to be opaque. -->
  <ref name="__{rng:name}-elt-{count(preceding::rng:element | ancestor::rng:element) + 1}"/>
</xsl:template>

<xsl:template match="rng:define[not(rng:element)]"/>

<xsl:template match="rng:ref[key('define-wo-element', @name)]">
	<xsl:apply-templates select="key('define-wo-element', @name)/*"/>
</xsl:template>

</xsl:stylesheet>
