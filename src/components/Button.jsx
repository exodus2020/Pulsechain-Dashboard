import styled from "styled-components";
import Icon from "./Icon";
import { icons_list } from "../config/icons";
import ImageContainer from "./ImageContainer";

const ButtonWrapper = styled.div`
  height: 100%; 
  width: 100%; 
  
  button {
      display: flex;
      align-items: center;
      justify-content: ${props => props.textalign === 'center' ? 'center' : 'flex-start'};
      background-color: rgb(30,30,30);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      outline: none;
      height: 100%; 
      width: 100%;
      margin-top: 0px;

      &:hover {
          box-shadow: inset 0px 0px 1px 1px white;
          transform: scale(1);
      }
  }

  .button-content {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      justify-content: ${props => props.textalign === 'center' ? 'center' : 'flex-start'};
  }

  &.button-disabled {
    cursor: default!important;
    button:hover {
      cursor: default!important;
      box-shadow: none !important;
      transform: none !important;
    }
  }

`;

export default function Button({ 
    children = null, 
    text, 
    icon, 
    image, 
    onClick, 
    style, 
    parentStyle, 
    customClass, 
    disabled,
    textAlign
}) {
    return (
        <ButtonWrapper 
            className={`${customClass ? customClass : ""} ${disabled ? 'button-disabled' : ''}`} 
            style={parentStyle ?? {}}
            textalign={textAlign}
        >
            <button 
                onClick={() => disabled ? () => {} : onClick?.()} 
                style={style ? { ...style } : {}} 
                disabled={disabled}
            >
                {children ? children :
                <div className="button-content">
                    {icon ? <Icon icon={icon} /> : ''}
                    {!icon && image ? <ImageContainer source={image} size={30}/> : ''}
                    <span style={{ marginLeft: image || icon ? 10 : 0 }}>{text ? text : "Default Text"}</span>
                </div>}
            </button>
        </ButtonWrapper>
    );
}