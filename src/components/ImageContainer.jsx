import React, { memo, useEffect, useState } from 'react';
import styled from 'styled-components';
import ImgQuestion from '../icons/question.png';

// Shared across token rows so missing images are not fetched repeatedly.
const failedImageUrls = new Set();
const metadataRequests = new Map();
const addressPattern = /^0x[a-f0-9]{40}$/i;
const IconWrapper = styled.div`
  border-radius: 5px;
  display: inline-block;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  svg { fill: currentColor; width: 100%; height: 100%; }
  img { border-radius: 3px; }
`;

// Packaged Electron uses file://; route metadata requests through the existing
// allowlisted main-process JSON bridge to avoid renderer CORS restrictions.
async function fetchLogoMetadata(url) {
  if (typeof window !== 'undefined' && window.electron?.fetchJson) {
    const result = await window.electron.fetchJson(url);
    if (!result?.ok) throw new Error(`Logo metadata HTTP ${result?.status || 0}`);
    return result.data;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Logo metadata HTTP ${response.status}`);
  return response.json();
}

// Resolve an actual image URL from a token's PulseChain contract address.
// Never guess CDN file paths: those may not exist even if a catalog has a logo.
function lookupLogo(address) {
  if (!metadataRequests.has(address)) {
    const request = fetchLogoMetadata(`https://api.dexscreener.com/latest/dex/tokens/${address}`)
      .then(async data => {
        const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
        const match = pairs.find(pair =>
          String(pair?.chainId).toLowerCase() === 'pulsechain' &&
          String(pair?.baseToken?.address).toLowerCase() === address &&
          /^https:\/\//i.test(pair?.info?.imageUrl || '')
        );
        if (match?.info?.imageUrl) return match.info.imageUrl;
        // Some smaller tokens have a profile logo but no pair image metadata.
        // Match by exact chain AND contract; never use a similarly named token.
        const profiles = await fetchLogoMetadata('https://api.dexscreener.com/token-profiles/latest/v1');
        const profile = (Array.isArray(profiles) ? profiles : []).find(item =>
          String(item?.chainId).toLowerCase() === 'pulsechain' &&
          String(item?.tokenAddress).toLowerCase() === address &&
          /^https:\/\//i.test(item?.icon || '')
        );
        return profile?.icon || null;
      })
      .catch(() => null);
    metadataRequests.set(address, request);
  }
  return metadataRequests.get(address);
}

const ImageContainer = ({ source, address, size = 24, style = {}, alt = '' }) => {
  const normalizedAddress = typeof address === 'string' && addressPattern.test(address)
    ? address.toLowerCase() : null;
  const [resolved, setResolved] = useState({ address: null, url: null });
  const [failedLocal, setFailedLocal] = useState(null);

  const primaryUnavailable = !source || source === ImgQuestion ||
    failedLocal === source || failedImageUrls.has(source);

  useEffect(() => {
    if (!normalizedAddress || !primaryUnavailable) return undefined;
    let cancelled = false;
    lookupLogo(normalizedAddress).then(url => {
      if (!cancelled) setResolved({ address: normalizedAddress, url });
    });
    return () => { cancelled = true; };
  }, [normalizedAddress, primaryUnavailable]);

  const alternative = resolved.address === normalizedAddress ? resolved.url : null;
  const displaySource = !primaryUnavailable ? source :
    alternative && !failedImageUrls.has(alternative) && failedLocal !== alternative
      ? alternative : ImgQuestion;

  const handleError = () => {
    if (displaySource === ImgQuestion) return;
    failedImageUrls.add(displaySource);
    setFailedLocal(displaySource);
  };

  return (
    <IconWrapper size={size} style={style}>
      <img src={displaySource} alt={alt} style={{ height: size, width: size }} onError={handleError} />
    </IconWrapper>
  );
};

export default memo(ImageContainer);
