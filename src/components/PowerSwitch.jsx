import styled, { css } from "styled-components";

const PowerButtonContainer = styled.div`
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;
  border-radius: 50%;
  background-color: #000;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0px 0px ${({ size }) => size * 0.4}px rgba(0, 0, 0, 0.8);
  overflow: hidden;
`;

const PowerButtonGlow = styled.div`
  width: ${({ size }) => size * 0.8}px;
  height: ${({ size }) => size * 0.8}px;
  border: ${({ size }) => size * 0.05}px solid
    ${({ status }) =>
      status === 1
        ? "#00ff00" // Green for ON
        : status === 2
        ? "#ff0000" // Red for OFF
        : status === 3
        ? "#ffff00" // Yellow for OTHER
        : "#4d4d4d"}; // Gray for default
  border-radius: 50%;
  box-shadow: 0px 0px ${({ size }) => size * 0.5}px
    ${({ status }) =>
      status === 1
        ? "#00ff00"
        : status === 2
        ? "#ff0000"
        : status === 3
        ? "#ffff00"
        : "#4d4d4d"};
  position: absolute;
  animation: ${({ status }) => (status !== 0 ? "glow 1.5s infinite" : "none")};
  @keyframes glow {
    0% {
      box-shadow: 0px 0px ${({ size }) => size * 0.4}px transparent;
    }
    50% {
      box-shadow: 0px 0px ${({ size }) => size * 0.6}px
        ${({ status }) =>
          status === 1
            ? "#00ff00"
            : status === 2
            ? "#ff0000"
            : status === 3
            ? "#ffff00"
            : "#4d4d4d"};
    }
    100% {
      box-shadow: 0px 0px ${({ size }) => size * 0.4}px transparent;
    }
  }
`;

const PowerIcon = styled.div`
  width: ${({ size }) => size * 0.15}px;
  height: ${({ size }) => size * 0.6}px;
  background-color: ${({ status }) =>
    status === 1
      ? "#00ff00"
      : status === 2
      ? "#ff0000"
      : status === 3
      ? "#ffff00"
      : "#4d4d4d"};
  border-radius: ${({ size }) => size * 0.1}px;
  position: absolute;
  top: 0px;
  border: black 1px solid;

  &::after {
    content: "";
    width: ${({ size }) => size * 0.6}px;
    height: ${({ size }) => size * 0.2}px;
    border-top: ${({ size }) => size * 0.05}px solid
      ${({ status }) =>
        status === 1
          ? "#00ff00"
          : status === 2
          ? "#ff0000"
          : status === 3
          ? "#ffff00"
          : "#4d4d4d"};
    border-radius: ${({ size }) => size * 0.3}px;
    position: absolute;
    top: ${({ size }) => size * -0.25}px;
    left: 50%;
    transform: translateX(-50%);
  }
`;

export default function PowerSwitch({ status = 0, size = 40 }) {
  return (
    <PowerButtonContainer size={size}>
      <PowerButtonGlow size={size} status={status} />
      <PowerIcon size={size} status={status} />
    </PowerButtonContainer>
  );
}
