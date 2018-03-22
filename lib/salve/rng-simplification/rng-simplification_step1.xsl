<?xml version="1.0" encoding="utf-8"?>
<!--
We use version 2 because either version 1 does not have base-uri() or
resolve-uri().

base-uri() is easy enough to emulate.

resolve-uri() is a different matter.
-->
<xsl:stylesheet version="2" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns="http://relaxng.org/ns/structure/1.0" xmlns:rng="http://relaxng.org/ns/structure/1.0" exclude-result-prefixes="rng">

<xsl:output method="xml"/>

<!--
A note on the why we add @datatypeLibrary.

Nicolas Debeissat's code was buggy. In Nicolas' code, step1 resolves external
references, and step 4 and 5 deal with propagating the @datatypeLibrary and
cleaning up those instances of the attribute that are unnecessary,
post-propagation. However, the Relax NG specification performs the propagation
of @datatypeLibrary (section 4.3) **before** resolving external references
(sections 4.5-4.7). The way the specification orders the steps has for
consequence that @datatypeLibrary propagation does not cross file
boundaries.For instance if a top-level schema contains:

<div datatypeLibrary="foo"><externalRef href="some-fragment.rng"/></div>

Then the schema in "some-fragment.rng" will **NOT** be affected by the presence
of @datatypeLibrary on the containing div. This is hilighteed in section 4.9
with the note:

"Since include and externalRef elements are resolved after datatypeLibrary
attributes are added but before ns attributes are added, ns attributes are
inherited into external schemas but datatypeLibrary attributes are not."

Nicolas' code originally had no provision for dealing with this: with his code
@datatypeLibrary propagation *would* erroneously cross file boundaries.

The code below adds @datatypeLibrary attributes with value "" to effectively
block propagation at the places where it would cross file boundaries.

-->

<!-- 7.7
externalRef patterns are replaced by the content of the resource referenced by their href attributes. All the simplification steps up to this one must be recursively applied during this replacement to make sure all schemas are merged at the same level of simplification.
-->

<!-- Original directory of the file we are simplifying. -->
<xsl:param name="originalDir"/>

<xsl:template match="*|text()|@*">
  <xsl:copy>
    <xsl:apply-templates select="@*"/>
    <xsl:apply-templates/>
  </xsl:copy>
</xsl:template>

<xsl:template match="rng:externalRef">
  <xsl:variable name="source"
                select="resolve-uri(@href, resolve-uri(base-uri(), $originalDir))"/>
  <xsl:variable name="doc" select="document($source)/*"/>
  <xsl:apply-templates select="$doc" mode="resolving-ref">
    <xsl:with-param name="source" select="$source"/>
    <xsl:with-param name="parent-ns" select="@ns"/>
  </xsl:apply-templates>
</xsl:template>

<xsl:template match="*" mode="resolving-ref">
  <xsl:param name="source"/>
  <xsl:param name="parent-ns"/>
  <xsl:copy copy-namespaces="yes" inherit-namespaces="yes">
    <xsl:if test="not(@ns) and $parent-ns">
      <xsl:attribute name="ns" select="$parent-ns"/>
    </xsl:if>
    <!-- If there is no @datatypeLibrary we want to set one with an empty value
         to prevent cross-file propagation of datatypeLibrary in later
         steps. -->
    <xsl:if test="not(@datatypeLibrary)">
      <xsl:attribute name="datatypeLibrary"/>
    </xsl:if>
    <xsl:variable name="docBase" select="@xml:base"/>
    <xsl:attribute name="xml:base">
      <xsl:choose>
        <xsl:when test="$docBase">
          <xsl:value-of select="resolve-uri($docBase, $source)"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$source"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:attribute>
    <xsl:apply-templates select="@*[not(. is $docBase)]|*|text()"/>
  </xsl:copy>
</xsl:template>

<!-- 7.8 The schemas referenced by include patterns are read and all
     the simplification steps up to this point are recursively applied
     to these schemas. Their definitions are overridden by those found
     in the include pattern itself when overrides are used. The
     content of their grammar is added in a new div pattern to the
     current schema. The div pattern is needed temporarily to carry
     namespace information to the next sequence of steps.
-->

<xsl:template match="rng:include">
  <xsl:variable name="source"
                select="resolve-uri(@href, resolve-uri(base-uri(), $originalDir))"/>
  <xsl:variable name="doc" select="document($source)/*"/>
    <!-- @datatypeLibrary is set to an empty value to prevent cross-file
         propagation of datatypeLibrary in later steps. -->
  <div datatypeLibrary="">
    <xsl:copy-of select="@*[name() != 'href']"/>
    <xsl:variable name="docBase" select="$doc/@xml:base"/>
    <xsl:attribute name="xml:base">
      <xsl:choose>
        <xsl:when test="$docBase">
          <xsl:value-of select="resolve-uri($docBase, $source)"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:value-of select="$source"/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:attribute>
    <div>
      <xsl:copy-of select="$doc/*[not(self::rng:start or self::rng:define)]|$doc/rng:start[not(current()/rng:start)]|$doc/rng:define[not(@name = current()/rng:define/@name)]|$doc/text()|$doc/@*[not(. is $docBase)]"/>
    </div>
    <xsl:copy-of select="*|text()"/>
  </div>
</xsl:template>
</xsl:stylesheet>
