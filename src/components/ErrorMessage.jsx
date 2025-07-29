import { useAtom } from "jotai"
import { appErrorAtom } from "../store"
import styled from "styled-components"
import { useMemo, useState } from "react"

const Wrapper = styled.div`
    position: absolute;
    bottom: 0;
    left: 0;
    transform: translateY(100%);
    width: 100vw;
    text-align: center;
    color: white;

    @media (min-width: 650px) {
        bottom: auto;
        top: 0px !important;
        left: 0;
    }
`
const SingleError = styled.div`
    position: absolute;
    bottom: 0;
    left: 0;
    transform: translateY(100%);
    width: 100vw;
    text-align: center;

    background: rgba(155, 50, 50, 0.2);
    font-size: 16px;
    
    @media (min-width: 650px) {
        text-align: left;
        padding: 10px 20px;
    }
`

const Acknowledge = styled.div`
    display: inline-block;
    padding: 0px 10px;
    border: 1px solid rgb(50,50,50);
    background: rgba(20,20,20, 0.5);
    margin-right: 20px;
    border-radius: 5px;
    cursor: pointer;
    &:hover {
        background: rgba(120,120,120, 0.5);
    }
`

export default function ErrorMessage () {
    const [errors, setErrors] = useAtom(appErrorAtom)
    
    const displayErrors = useMemo(() => {
        const newErrors = []
        errors.forEach(fe => {
            const existingRecord = newErrors.find(existing => existing.id == fe.id)
            if (existingRecord) {
                existingRecord.count += 1;
            } else {
                newErrors.push({
                    ...fe,
                    count: 1
                })
            }
        })
        return newErrors
    }, [errors])

    const handleRemoveError = (id) => {
        
        setErrors(prev => {
            const newErrors = prev.filter(f => f.id != id)
            return newErrors
        })
    }

    return <Wrapper>
        {displayErrors.map((m, i) => {
           return <SingleError>
                <Acknowledge onClick={() => handleRemoveError(m?.id ?? '')}>
                    X
                </Acknowledge>
                {m?.msg ?? ''} ({m?.count ?? ''})
           </SingleError> 
        })}
    </Wrapper>
}